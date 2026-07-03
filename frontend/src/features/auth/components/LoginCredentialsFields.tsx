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
        <label className="label text-slate-700">아이디</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            className="input pl-11 bg-slate-50/50 border-slate-100"
            placeholder="사용자 아이디"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            required
            autoComplete="username"
          />
        </div>
      </div>
      <div>
        <label className="label text-slate-700">비밀번호</label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="password"
            className="input pl-11 bg-slate-50/50 border-slate-100"
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
