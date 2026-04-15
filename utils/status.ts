/**
 * Checks if a client's status string indicates the check has been sent.
 * Centralised logic — data always comes from the API with a normalized `status` field.
 */
export const isClientSentByStatus = (status: string | undefined | null): boolean => {
  if (!status) return false;
  return status.toString().trim().toLowerCase().includes('отправлено');
};
