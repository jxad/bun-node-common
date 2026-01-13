import { Model } from "sequelize";

export abstract class ContextBase<T extends object> extends Model<T> { }