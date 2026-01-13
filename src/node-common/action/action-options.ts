/** Action options use to customize action behavior */
export interface ActionOptions {
  /** If true, will automatically send a BAD REQUEST (400) json response when missing parameters are detected
   * @default true
   */
  badRequestOnMissingParameters?: boolean

  /** jwt secret key 
   * @default null
  */
  jwtSecret?: string | undefined
  
  /** If true, is going to enable jwt validation
   * @default false
   */
  enableJwtValidation?: boolean
}