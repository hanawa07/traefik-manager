import Modal from "@/shared/components/Modal";

import { useCreateUser } from "../hooks/useUsers";
import UserForm from "./UserForm";
import { UserMutationError } from "./UserMutationError";

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserCreateModal({ isOpen, onClose }: UserCreateModalProps) {
  const createUser = useCreateUser();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="사용자 추가">
      <UserMutationError error={createUser.error} fallbackMessage="사용자 추가 중 오류가 발생했습니다" />
      <UserForm
        loading={createUser.isPending}
        submitLabel="사용자 추가"
        onSubmit={async (data) => {
          await createUser.mutateAsync({
            username: data.username,
            password: data.password || "",
            role: data.role,
            is_active: data.is_active,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
