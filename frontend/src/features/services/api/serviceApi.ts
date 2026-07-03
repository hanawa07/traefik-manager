import { serviceAuthentikApi } from "./service-api/serviceAuthentikApi";
import { serviceCrudApi } from "./service-api/serviceCrudApi";
import { serviceHealthApi } from "./service-api/serviceHealthApi";

export type {
  AuthentikGroup,
  AuthMode,
  BasicAuthCredential,
  FramePolicy,
  Service,
  ServiceCreate,
  ServiceGatewayDiagnosis,
  ServiceGatewayDiagnosticCheck,
  ServiceGatewayNetworkConnectResult,
  ServiceUpdate,
  UpstreamHealth,
} from "./service-api/serviceTypes";

export const serviceApi = {
  ...serviceCrudApi,
  ...serviceAuthentikApi,
  ...serviceHealthApi,
};
