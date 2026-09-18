import { Suspense } from "react";

import { PasswordRecoveryForm } from "../../../components/auth/auth-forms";

export default function PasswordRecoveryPage() {
  return (
    <Suspense>
      <PasswordRecoveryForm />
    </Suspense>
  );
}
