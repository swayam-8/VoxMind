import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
export function useSignInMethods() {
  return useQuery({ queryKey: ["google-account"], queryFn: () => apiClient.get<{ configured: boolean; connected: boolean; has_password: boolean }>("/auth/google/connection") });
}
