// @wapixia/types — types TypeScript partagés entre tous les packages

/** Rôles utilisateur dans la hiérarchie WapixIA */
export type UserRole =
  | 'superadmin'
  | 'reseller_admin'
  | 'reseller_user'
  | 'client_admin'
  | 'client_user'

/** Secteurs d'activité supportés */
export type BusinessSector =
  | 'btp'
  | 'beaute'
  | 'horeca'
  | 'immobilier'
  | 'medical'
  | 'automobile'
  | 'commerce'
  | 'b2b'
  | 'fitness'
  | 'asbl'
  | 'autre'

/** Statut d'un site client */
export type SiteStatus = 'draft' | 'generating' | 'review' | 'active' | 'suspended'

/** Statut d'un contenu IA */
export type ContentStatus = 'pending_validation' | 'approved' | 'rejected' | 'published'

/** Réponse API standard — succès */
export interface ApiResponse<T> {
  data: T
  meta?: {
    page?: number
    total?: number
    limit?: number
  }
}

/** Réponse API standard — erreur */
export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/** Résultat d'une opération service */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }
