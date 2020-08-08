import { Request, Response } from "express";
import db from "../database/connection";
import convertHourToMinutes from "../utils/convertHourToMinutes";

export interface ScheduleItem {
  week_day: number;
  from: string;
  to: string;
}

export default class ClassController {
  async index(req: Request, resp: Response) {
    const filters = req.query;

    const subject = filters.subject as string;
    const week_day = filters.week_day as string;
    const time = filters.time as string;

    if (!filters.week_day || !filters.subject || !filters.time) {
      return resp
        .status(400)
        .json({ error: "Missing filters to search classes" });
    }

    const timeInMinutes = convertHourToMinutes(time);

    const classes = await db("classes")
      .whereExists(function () {
        this.select("class_schedule.*")
          .from("class_schedule")
          .whereRaw("`class_schedule`.`class_id` =  `classes`.`id`")
          .whereRaw("`class_schedule`.`week_day` = ??", [Number(week_day)])
          .whereRaw("`class_schedule`.`from` <= ??", [timeInMinutes])
          .whereRaw("`class_schedule`.`to` > ??", [timeInMinutes]);
      })
      .where("classes.subject", "=", subject)
      .join("users", "classes.user_id", "=", "users.id")
      .select("classes.*", "users.*");

    return resp.json({ classes });
  }

  async create(req: Request, resp: Response) {
    const { name, avatar, whatsapp, bio, subject, cost, schedule } = req.body;

    const trx = await db.transaction();

    try {
      const insertedUsersIds = await trx("users").insert({
        name,
        avatar,
        whatsapp,
        bio,
      });

      const userId = insertedUsersIds[0];

      const insertedClassesIds = await trx("classes").insert({
        subject,
        cost,
        user_id: userId,
      });

      const classId = insertedClassesIds[0];

      const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
        return {
          ...scheduleItem,
          class_id: classId,
          from: convertHourToMinutes(scheduleItem.from),
          to: convertHourToMinutes(scheduleItem.to),
        };
      });

      await trx("class_schedule").insert(classSchedule);

      await trx.commit();

      return resp.status(201).send({ success: true });
    } catch (error) {
      await trx.rollback();
      return resp
        .status(400)
        .json({ error: "Unexpected error while creating new class" });
    }
  }
}
