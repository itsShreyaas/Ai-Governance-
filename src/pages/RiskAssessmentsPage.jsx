import React from "react";
import { ShieldAlert } from "lucide-react";
import { PagePlaceholder } from "../components/common/PagePlaceholder";

export const RiskAssessmentsPage = () => {
  return (
    <PagePlaceholder
      title="Risk Assessments"
      description="Detailed NIST AI RMF, ISO 42001, and EU AI Act impact assessments, privacy evaluations, and vendor security questionnaires"
      badge="Stage 2 Scheduled"
      icon={ShieldAlert}
    />
  );
};
