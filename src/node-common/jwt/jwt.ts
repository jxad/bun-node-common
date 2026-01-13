import { JsonWebTokenError, default as jwt } from "jsonwebtoken"

/** Registered claims: https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-claims#registered-claims */
export interface JwtBuildOptions {
  /** The JWT payload body */
  body: object,
  /** Used to sign the JWT. If provided is going to ignore the one specified during module initialization */
  secret?: string
  /** Time after which the JWT expires. Expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d" */
  expiresIn: string | number,
  /** Time before which the JWT must not be accepted for processing. Expressed in seconds or a string describing a time span [zeit/ms](https://github.com/zeit/ms.js).  Eg: 60, "2 days", "10h", "7d" */
  notBefore?: string | number,
  /** Issuer of the JWT */
  issuer?: string,
  /** Subject of the JWT (the user) */
  subject?: string,
  /** Unique identifier of the audience for an issued token. Named aud in a token, its value contains the ID of either an application (Client ID) for an ID Token or an API (API Identifier) for an Access Token. */
  audience?: string | string[],
  /** (JWT ID): Unique identifier; can be used to prevent the JWT from being replayed (allows a token to be used only once) */
  jwtid?: string,
}

/** JWT manager module. This module is scoped, and the jwt secret is persisted locally in the instance created.
 * https://auth0.com/docs/secure/tokens/json-web-tokens
 */
export class Jwt {
  private jwtSecret: string | undefined

  constructor(jwtSecret?: string) {
    this.jwtSecret = jwtSecret
  }

  /** Build a JWT. */
  build(buildOptions: JwtBuildOptions) {
    const secret = buildOptions.secret ? buildOptions.secret : this.jwtSecret
    if (!secret) {
      throw new Error("No secret provided to sign the JWT")
    }

    let signOptions: jwt.SignOptions = {
      algorithm: "HS256",
      expiresIn: buildOptions.expiresIn as jwt.SignOptions["expiresIn"]
    }
    if (buildOptions.notBefore) signOptions.notBefore = buildOptions.notBefore as jwt.SignOptions["notBefore"]
    if (buildOptions.issuer) signOptions.issuer = buildOptions.issuer
    if (buildOptions.subject) signOptions.subject = buildOptions.subject
    if (buildOptions.audience) signOptions.audience = buildOptions.audience
    if (buildOptions.jwtid) signOptions.jwtid = buildOptions.jwtid

    return jwt.sign(buildOptions.body, secret, signOptions)
  }

  /** Validate the given JWT
   * @param token The token to validate
   * @param secret Used to check if the token is valid. If provided is going to ignore the one specified during module initialization
   * @returns True if the token is valid, false otherwise
   */
  verify(token: string, secret?: string) {
    if (!secret) {
      if (!this.jwtSecret) {
        throw new Error("No secret provided to validate the JWT")
      }

      secret = this.jwtSecret
    }

    try {
      jwt.verify(token, secret)

      return true
    } catch (err) {
      if (err instanceof JsonWebTokenError) return false
      throw err
    }
  }

  /** Extract payload from the given JWT. The payload is deserialized to an object of type T.
   * If validate is true and token is not valid, the method will thrown an error
   * @param token The JWT to extract the payload from
   * @param validate If true, is going to validate the JWT before extracting the payload. Default false
   * @param secret Used to check if the token is valid. If provided is going to ignore the one specified during module initialization
   * @returns The payload of the JWT
   * @throws Error if the token is not valid and validate is true
   */
  getPayload(token: string, validate: boolean = false, secret?: string): string {
    if (validate && !this.verify(token, secret)) {
      throw new Error("Invalid token")
    }

    return JSON.stringify(jwt.decode(token))
  }
}