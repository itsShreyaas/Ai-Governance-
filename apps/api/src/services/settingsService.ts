import mongoose from "mongoose";
import { AuditEventType, AuditSeverity } from "@aegisai/shared";
import type { UpdateSettingsInput } from "@aegisai/shared";
import { Settings, type ISettings } from "../models/Settings.js";
import { appendAuditEvent } from "./auditService.js";

const DEFAULT_SETTINGS_ID = new mongoose.Types.ObjectId("000000000000000000000001");

export interface SettingsActor {
  id: string;
  department: string;
}

function settingsDto(settings: {
  organizationName: string;
  departments: string[];
  sensitivityTiers: string[];
  enabledFrameworks: string[];
  scoreWeights: { nistAiRmf: number; iso42001: number; euAiAct: number };
  slackWebhookUrl?: string | null;
  smtpUrl?: string | null;
}) {
  return {
    organizationName: settings.organizationName,
    departments: settings.departments,
    sensitivityTiers: settings.sensitivityTiers,
    enabledFrameworks: settings.enabledFrameworks,
    scoreWeights: settings.scoreWeights,
    slackWebhookConfigured: Boolean(settings.slackWebhookUrl),
    smtpConfigured: Boolean(settings.smtpUrl),
  };
}

export async function getSettings() {
  let settings = await Settings.findOne({});
  if (settings == null) {
    settings = await Settings.findOneAndUpdate(
      { _id: DEFAULT_SETTINGS_ID },
      { $setOnInsert: {} },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  if (settings == null) throw new Error("Settings initialization failed");
  return settingsDto(settings);
}

export async function updateSettings(input: UpdateSettingsInput, actor: SettingsActor) {
  const session = await mongoose.startSession();
  let updated: ISettings | null = null;
  try {
    await session.withTransaction(async () => {
      let current = await Settings.findOne({}).session(session);
      if (current == null) {
        current = await Settings.findOneAndUpdate(
          { _id: DEFAULT_SETTINGS_ID },
          { $setOnInsert: {} },
          { upsert: true, new: true, setDefaultsOnInsert: true, session }
        );
      }
      if (current == null) throw new Error("Settings initialization failed");

      updated = await Settings.findOneAndUpdate(
        { _id: current._id },
        { $set: input },
        { new: true, runValidators: true, session }
      );
      if (updated == null) throw new Error("Settings update failed");

      const changedFields = Object.keys(input).filter((field) => field !== "slackWebhookUrl" && field !== "smtpUrl");
      const secretChanged = input.slackWebhookUrl !== undefined || input.smtpUrl !== undefined;
      const details = [
        ...(changedFields.length === 0 ? [] : [`fields=${changedFields.join(",")}`]),
        ...(secretChanged ? ["secret settings changed"] : []),
      ].join("; ");
      await appendAuditEvent(
        {
          eventType: AuditEventType.SettingsUpdated,
          severity: AuditSeverity.Info,
          actorId: actor.id,
          department: actor.department,
          details: `Settings updated; ${details}`,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
  if (updated == null) throw new Error("Settings update transaction did not complete");
  return settingsDto(updated);
}