const requiredProperties = new Map<Function, string[]>()

/**
 * A decorator used to mark properties as required in a class.
 * When applied to a property, this decorator adds the property key to a registry
 * which is then used for validation. This registry is stored in a Map where each
 * class's constructor serves as the key, and the array of required property names
 * as the value.
 *
 * @param target - The constructor function of the class for the instance member.
 * @param propertyKey - The name of the property.
 */
export const required = (target: any, propertyKey: string): void => {
  let props = requiredProperties.get(target.constructor) || []
  props.push(propertyKey)
  requiredProperties.set(target.constructor, props)
}

export class ActionRequestBase {
  /** 
   * Validates an object instance against the required properties.
   * This function checks if all properties marked as required in the class
   * definition (using the required decorator) are present and not null.
   * The method returns *null* if the validation succeded. Otherwise a list of the missing required properties names.
  */
  static validate<T extends ActionRequestBase, Args extends any[]>(this: new (...args: Args) => T, ...args: Args): string[] | undefined {
    var missingRequiredProperties = validateRequest(new this(...args))
    if (missingRequiredProperties.length > 0) return missingRequiredProperties
    return undefined
  }
}

/**
 * Validates an object instance against the required properties.
 * This function checks if all properties marked as required in the class
 * definition (using the required decorator) are present and not null
 * in the given object. It uses the `requiredProperties` map to find out
 * which properties are marked as required for the object's class.
 *
 * @param obj - The object instance to be validated.
 * @returns An array of strings, each representing a missing required property.
 *          If all required properties are present, returns an empty array.
*/
const validateRequest = (obj: any): string[] => {
  const requiredProps = requiredProperties.get(obj.constructor) || []
  return requiredProps.filter(prop => obj[prop] === undefined || obj[prop] === null)
}