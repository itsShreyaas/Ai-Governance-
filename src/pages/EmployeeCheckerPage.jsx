import React from "react";
import { UserCheck } from "lucide-react";
import { PagePlaceholder } from "../components/common/PagePlaceholder";

export const EmployeeCheckerPage = () => {
  return (
    <PagePlaceholder
      title="Employee AI Checker"
      description="Self-service portal allowing employees to verify whether an AI tool, extension, or model is approved for their department and data sensitivity tier"
      badge="Stage 2 Scheduled"
      icon={UserCheck}
    />
  );
};
