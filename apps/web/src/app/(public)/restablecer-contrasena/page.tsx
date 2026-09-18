import { Suspense } from "react";

import { PasswordResetForm } from "../../../components/auth/auth-forms";

export default function PasswordResetPage() {
  return (
    <Suspense>
      <PasswordResetForm />
    </Suspense>
  );
}
