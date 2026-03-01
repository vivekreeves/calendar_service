import { getPool } from "../db/pool.js";
import { isProjectActive } from "./projectConfigService.js";

export type HolidayResult = {
  project_id: string;
  date: string;
  country_code: string;
  is_working_day: boolean;
  reason: string;
  holiday_name: string | null;
};

export async function getHolidayStatus(
  projectId: string,
  date: string,
  countryCode: string
): Promise<HolidayResult> {
  if (!isProjectActive(projectId)) {
    throw new Error(`Project ${projectId} is inactive`);
  }

  const pool = getPool();
  const result = await pool.query(
    "SELECT holiday_name FROM country WHERE country_code = $1 AND holiday_date = $2 LIMIT 1",
    [countryCode, date]
  );

  const holidayName = result.rows[0]?.holiday_name ?? null;
  if (holidayName) {
    return {
      project_id: projectId,
      date,
      country_code: countryCode,
      is_working_day: false,
      reason: "holiday",
      holiday_name: holidayName,
    };
  }

  return {
    project_id: projectId,
    date,
    country_code: countryCode,
    is_working_day: true,
    reason: "working_day",
    holiday_name: null,
  };
}
