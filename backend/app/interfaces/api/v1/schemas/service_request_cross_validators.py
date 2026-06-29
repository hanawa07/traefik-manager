def validate_service_create_cross_fields(model):
    if model.auth_mode == "none" and model.auth_enabled is True:
        model.auth_mode = "authentik"

    if model.https_redirect_enabled and not model.tls_enabled:
        raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")

    if model.auth_mode != "authentik" and model.authentik_group_id:
        raise ValueError("Authentik 인증 모드에서만 Authentik 그룹을 설정할 수 없습니다")

    if model.auth_mode != "none" and model.basic_auth_enabled:
        raise ValueError("인증 모드와 Basic Auth는 동시에 설정할 수 없습니다")

    if model.basic_auth_enabled and not model.basic_auth_credentials:
        raise ValueError("Basic Auth를 활성화하려면 사용자 이름과 비밀번호를 입력해야 합니다")
    if not model.basic_auth_enabled and model.basic_auth_credentials:
        raise ValueError("Basic Auth 비활성화 상태에서는 사용자 정보를 함께 보낼 수 없습니다")
    if (model.rate_limit_average is None) ^ (model.rate_limit_burst is None):
        raise ValueError("Rate Limit을 활성화하려면 average와 burst를 모두 입력해야 합니다")
    return model


def validate_service_update_cross_fields(model):
    if model.auth_mode is None and model.auth_enabled is not None:
        model.auth_mode = "authentik" if model.auth_enabled else "none"

    if model.https_redirect_enabled and model.tls_enabled is False:
        raise ValueError("HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다")

    if model.auth_mode is not None:
        if model.auth_mode != "authentik" and model.authentik_group_id:
            raise ValueError("Authentik 인증 모드에서만 Authentik 그룹을 설정할 수 없습니다")
        if model.auth_mode != "none" and model.basic_auth_enabled is True:
            raise ValueError("인증 모드와 Basic Auth는 동시에 설정할 수 없습니다")

    if model.basic_auth_enabled is False and model.basic_auth_credentials:
        raise ValueError("Basic Auth 비활성화 상태에서는 사용자 정보를 함께 보낼 수 없습니다")
    if model.basic_auth_enabled is True and model.basic_auth_credentials is not None and not model.basic_auth_credentials:
        raise ValueError("Basic Auth를 활성화하려면 사용자 이름과 비밀번호를 입력해야 합니다")
    if model.rate_limit_enabled is True:
        if model.rate_limit_average is None or model.rate_limit_burst is None:
            raise ValueError("Rate Limit을 활성화하려면 average와 burst를 모두 입력해야 합니다")
    if model.rate_limit_enabled is False:
        if model.rate_limit_average is not None or model.rate_limit_burst is not None:
            raise ValueError("Rate Limit 비활성화 시 값을 함께 보낼 수 없습니다")
    return model
