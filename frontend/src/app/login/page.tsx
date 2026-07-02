"use client";

import LoginPageView from "./LoginPageView";
import { useLoginPageModel } from "./useLoginPageModel";

export default function LoginPage() {
  const loginPage = useLoginPageModel();

  return <LoginPageView {...loginPage} />;
}
