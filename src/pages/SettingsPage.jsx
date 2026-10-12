import React from "react";
import { Settings } from "lucide-react";
import { PagePlaceholder } from "../components/common/PagePlaceholder";

export const SettingsPage = () => {
  return (
    <PagePlaceholder
      title="Governance Settings"
      description="Configure organization identity, compliance framework mappings (NIST, ISO 42001, EU AI Act), SSO integrations, and notification webhooks"
      badge="Stage 2 Scheduled"
      icon={Settings}
    />
  );
};
