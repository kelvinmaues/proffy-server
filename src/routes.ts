import express, { response } from "express";
import db from "./database/connection";
import convertHourToMinutes from "./utils/convertHourToMinutes";

const routes = express.Router();

export interface ScheduleItem {
  week_day: number;
  from: string;
  to: string;
}

routes.post("/classes", async (req, resp) => {
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
    return response
      .status(400)
      .json({ error: "Unexpected error while creating new class" });
  }
});

export default routes;
