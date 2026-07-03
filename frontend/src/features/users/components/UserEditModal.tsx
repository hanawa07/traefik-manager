import Modal from "@/shared/components/Modal";

import type { User } from "../api/userApi";
import { useUpdateUser } from "../hooks/useUsers";
import UserForm, { type UserFormValue } from "./UserForm";
import { UserMutationError } from "./UserMutationError";

interface UserEditModalProps {
  user: User | null;
  onClose: () => void;
}

export function UserEditModal({ user, onClose }: UserEditModalProps) {
  const updateUser = useUpdateUser(user?.id || "");

  return (
    <Modal isOpen={!!user} onClose={onClose} title="사용자 수정">
      {user ? (
        <>
          <UserMutationError error={updateUser.error} fallbackMessage="사용자 수정 중 오류가 발생했습니다" />
          <UserForm
            defaultValues={user}
            loading={updateUser.isPending}
            submitLabel="수정 완료"
            onSubmit={async (data: UserFormValue) => {
              await updateUser.mutateAsync({
                username: data.username,
                role: data.role,
                is_active: data.is_active,
                ...(data.password ? { password: data.password } : {}),
              });
              onClose();
            }}
          />
        </>
      ) : null}
    </Modal>
  );
}
