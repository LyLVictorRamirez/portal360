import assert from "node:assert/strict";
import test from "node:test";

import { validateActivityForm, type ActivityFormValues } from "./activity-form-validation.ts";

const validForm: ActivityFormValues = {
  activityCategoryId: "category-1",
  assignedUserId: "user-1",
  blockedReason: "",
  containerId: "project-1",
  containerType: "project",
  customerCommitmentDate: "",
  description: null,
  estimatedHours: "1",
  isCustomerDeliverable: false,
  name: "Actividad",
  parentActivityId: "",
  priority: "medium",
  projectStageId: "stage-1",
  status: "pending",
  targetDate: "",
  waitingFor: "",
  waitingReason: "",
};

test("identifies every missing required Activity field", () => {
  assert.deepEqual(
    validateActivityForm(
      {
        ...validForm,
        activityCategoryId: "",
        assignedUserId: "",
        containerId: "",
        estimatedHours: "",
        name: " ",
        projectStageId: "",
      },
      true,
    ),
    {
      activityCategoryId: "Selecciona una categoría.",
      assignedUserId: "Selecciona un responsable.",
      containerId: "Selecciona un proyecto.",
      estimatedHours: "Indica la estimación en horas.",
      name: "Indica el nombre de la Actividad.",
      projectStageId: "Selecciona una etapa del Proyecto.",
    },
  );
});

test("identifies required fields that depend on the selected Activity state", () => {
  assert.deepEqual(
    validateActivityForm(
      {
        ...validForm,
        customerCommitmentDate: "",
        isCustomerDeliverable: true,
        status: "waiting_third_party",
        waitingFor: "",
        waitingReason: " ",
      },
      true,
    ),
    {
      customerCommitmentDate: "Indica la fecha de compromiso con el cliente.",
      waitingFor: "Selecciona a quién se está esperando.",
      waitingReason: "Indica el motivo de espera.",
    },
  );
});
