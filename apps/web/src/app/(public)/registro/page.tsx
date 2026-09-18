import { Suspense } from "react";

import { RegisterForm } from "../../../components/auth/auth-forms";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
