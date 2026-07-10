import { Lock, User } from "lucide-react";

interface LoginCredentialsFieldsProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}

export function LoginCredentialsFields({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
}: LoginCredentialsFieldsProps) {
  return (
    <>
      <div>
        <label className="label text-slate-700 dark:text-slate-300">아이디</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            className="input border-slate-100 bg-slate-50/50 pl-11 dark:border-slate-700 dark:bg-slate-950/70"
            placeholder="사용자 아이디"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            required
            autoComplete="username"
          />
        </div>
      </div>
      <div>
        <label className="label text-slate-700 dark:text-slate-300">비밀번호</label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
          <input
            type="password"
            className="input border-slate-100 bg-slate-50/50 pl-11 dark:border-slate-700 dark:bg-slate-950/70"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
      </div>
    </>
  );
}
