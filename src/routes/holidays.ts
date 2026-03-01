import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getHolidayStatus } from "../services/holidayService.js";
import { enqueueRequest } from "../services/messageQueueService.js";
import { logProjectRequest } from "../services/logService.js";
import { recordRequestMetrics } from "../services/metricsService.js";

type HolidayCheckQuery = {
  project_id: string;
  date: string;
  country_code: string;
};

type BatchCheckBody = {
  project_id: string;
  country_code: string;
  dates: string[];
};

type MultiCheckBody = {
  queries: { project_id: string; date: string; country_code: string }[];
};

export default async function holidayRoutes(app: FastifyInstance) {
  // Simple stub: weekend vs weekday; replace with DB + cache lookup later.
  app.get(
    "/v1/holiday/check",
    async (request: FastifyRequest<{ Querystring: HolidayCheckQuery }>, reply: FastifyReply) => {
      const startTime = process.hrtime.bigint();
      const { project_id, date, country_code } = request.query;
      if (!project_id || !date || !country_code) {
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        logProjectRequest({
          timestamp: new Date().toISOString(),
          project_id: project_id ?? "unknown",
          date: date ?? "unknown",
          country_code: country_code ?? "unknown",
          status: 400,
          duration_ms: durationMs,
          error: "project_id, date, and country_code are required",
        });
        recordRequestMetrics(project_id ?? "unknown", durationMs);
        return reply.code(400).send({ message: "project_id, date, and country_code are required" });
      }
      await enqueueRequest({ project_id, date, country_code });
      try {
        const result = await getHolidayStatus(project_id, date, country_code);
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        logProjectRequest({
          timestamp: new Date().toISOString(),
          project_id,
          date,
          country_code,
          status: 200,
          duration_ms: durationMs,
          is_working_day: result.is_working_day,
          holiday_name: result.holiday_name,
          reason: result.reason,
        });
        recordRequestMetrics(project_id, durationMs);
        return result;
      } catch (error) {
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        logProjectRequest({
          timestamp: new Date().toISOString(),
          project_id,
          date,
          country_code,
          status: 403,
          duration_ms: durationMs,
          error: (error as Error).message,
        });
        recordRequestMetrics(project_id, durationMs);
        return reply.code(403).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/v1/holiday/check",
    async (request: FastifyRequest<{ Body: BatchCheckBody }>, reply: FastifyReply) => {
      const startTime = process.hrtime.bigint();
      const { project_id, dates, country_code } = request.body ?? {};
      if (!project_id || !country_code || !Array.isArray(dates) || dates.length === 0) {
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        logProjectRequest({
          timestamp: new Date().toISOString(),
          project_id: project_id ?? "unknown",
          date: "batch",
          country_code: country_code ?? "unknown",
          status: 400,
          duration_ms: durationMs,
          error: "project_id, country_code and dates[] are required",
        });
        recordRequestMetrics(project_id ?? "unknown", durationMs);
        return reply.code(400).send({ message: "project_id, country_code and dates[] are required" });
      }
      await Promise.all(dates.map((date) => enqueueRequest({ project_id, date, country_code })));
      try {
        const results = await Promise.all(
          dates.map((date) => getHolidayStatus(project_id, date, country_code))
        );
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        for (const result of results) {
          logProjectRequest({
            timestamp: new Date().toISOString(),
            project_id,
            date: result.date,
            country_code,
            status: 200,
            duration_ms: durationMs,
            is_working_day: result.is_working_day,
            holiday_name: result.holiday_name,
            reason: result.reason,
          });
        }
        recordRequestMetrics(project_id, durationMs);
        return { results };
      } catch (error) {
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        logProjectRequest({
          timestamp: new Date().toISOString(),
          project_id,
          date: "batch",
          country_code,
          status: 403,
          duration_ms: durationMs,
          error: (error as Error).message,
        });
        recordRequestMetrics(project_id, durationMs);
        return reply.code(403).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/v1/holiday/check-multi",
    async (request: FastifyRequest<{ Body: MultiCheckBody }>, reply: FastifyReply) => {
      const startTime = process.hrtime.bigint();
      const { queries } = request.body ?? {};
      if (!Array.isArray(queries) || queries.length === 0) {
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        logProjectRequest({
          timestamp: new Date().toISOString(),
          project_id: "unknown",
          date: "batch",
          country_code: "unknown",
          status: 400,
          duration_ms: durationMs,
          error: "queries[] is required",
        });
        recordRequestMetrics("unknown", durationMs);
        return reply.code(400).send({ message: "queries[] is required" });
      }
      await Promise.all(queries.map((item) => enqueueRequest(item)));
      try {
        const results = await Promise.all(
          queries.map(({ project_id, date, country_code }) =>
            getHolidayStatus(project_id, date, country_code)
          )
        );
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        for (const result of results) {
          logProjectRequest({
            timestamp: new Date().toISOString(),
            project_id: result.project_id,
            date: result.date,
            country_code: result.country_code,
            status: 200,
            duration_ms: durationMs,
            is_working_day: result.is_working_day,
            holiday_name: result.holiday_name,
            reason: result.reason,
          });
          recordRequestMetrics(result.project_id, durationMs);
        }
        return { results };
      } catch (error) {
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
        logProjectRequest({
          timestamp: new Date().toISOString(),
          project_id: "unknown",
          date: "batch",
          country_code: "unknown",
          status: 403,
          duration_ms: durationMs,
          error: (error as Error).message,
        });
        recordRequestMetrics("unknown", durationMs);
        return reply.code(403).send({ message: (error as Error).message });
      }
    }
  );
}
