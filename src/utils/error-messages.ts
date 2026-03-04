/**
 * Utility functions for generating clear error messages
 * Requirements: R1.4, N2.2
 */

import { GistError } from '../services/gist-client';

/**
 * Get user-friendly error message from GistError
 */
export function getGistErrorMessage(error: GistError): string {
  switch (error.type) {
    case 'unauthorized':
      return 'No se pudo autenticar. Verifica tu token de GitHub e intenta nuevamente.';
    case 'not_found':
      return 'Gist no encontrado. Verifica el ID del Gist en la configuración.';
    case 'conflict':
      return 'Conflicto de datos detectado. Los datos fueron modificados remotamente. Por favor, recarga la página.';
    case 'rate_limit':
      return 'Límite de API de GitHub excedido. Por favor, intenta más tarde.';
    case 'server_error':
      return 'Error del servidor de GitHub. Por favor, intenta en unos momentos.';
    case 'network_error':
      return 'Error de red. Verifica tu conexión a internet.';
    default:
      return `Ocurrió un error: ${error.message}`;
  }
}

/**
 * Get user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof GistError) {
    return getGistErrorMessage(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Ocurrió un error inesperado. Por favor, intenta nuevamente.';
}

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  // Authentication
  AUTH_INVALID_TOKEN: 'Token de GitHub inválido. Verifica tu token e intenta nuevamente.',
  AUTH_TOKEN_EXPIRED: 'Tu token de GitHub ha expirado. Por favor, genera uno nuevo.',
  AUTH_MISSING_TOKEN: 'No se encontró token de GitHub. Por favor, autentícate primero.',
  AUTH_INVALID_SCOPE: 'El token no tiene los permisos necesarios. Asegúrate de incluir el scope "gist".',

  // Network
  NETWORK_ERROR: 'Error de red. Verifica tu conexión a internet.',
  NETWORK_TIMEOUT: 'La solicitud tardó demasiado. Por favor, intenta nuevamente.',
  NETWORK_OFFLINE: 'Sin conexión a internet. Los cambios se guardarán cuando vuelvas a estar en línea.',

  // Data
  DATA_SAVE_FAILED: 'Error al guardar los datos. Por favor, intenta nuevamente.',
  DATA_LOAD_FAILED: 'Error al cargar los datos. Por favor, intenta nuevamente.',
  DATA_CONFLICT: 'Conflicto de datos detectado. Por favor, recarga la página e intenta nuevamente.',
  DATA_SYNC_FAILED: 'Error al sincronizar con GitHub. Los cambios se guardarán localmente.',

  // Validation
  VALIDATION_REQUIRED_FIELD: 'Este campo es requerido.',
  VALIDATION_INVALID_FORMAT: 'Formato inválido. Verifica tu entrada.',
  VALIDATION_DUPLICATE: 'Este valor ya existe.',
  VALIDATION_INVALID_NUMBER: 'Debe ser un número válido.',
  VALIDATION_NEGATIVE_NOT_ALLOWED: 'No se permiten valores negativos.',
  VALIDATION_INSUFFICIENT_STOCK: 'Stock insuficiente para esta operación.',

  // Generic
  GENERIC_ERROR: 'Ocurrió un error. Por favor, intenta nuevamente.',
  GENERIC_SUCCESS: 'Operación completada exitosamente.',
  GENERIC_LOADING: 'Cargando...',
  GENERIC_SAVING: 'Guardando...',
  GENERIC_NO_DATA: 'No hay datos disponibles.',
} as const;
