import React from "react";
import { FileSpreadsheet } from "lucide-react";
import { PagePlaceholder } from "../components/common/PagePlaceholder";

export const PolicyMatrixPage = () => {
  return (
    <PagePlaceholder
      title="Policy Matrix"
      description="Corporate rules governing data classification tiers, allowable AI prompts, and automated DLP enforcement rules"
      badge="Stage 2 Scheduled"
      icon={FileSpreadsheet}
    />
  );
};
