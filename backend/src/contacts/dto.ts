import { IsEnum, IsString, MinLength } from 'class-validator';

export enum ContactIdentifierType {
  EMAIL = 'email',
  PHONE = 'phone',
}

export class FindContactDto {
  @IsEnum(ContactIdentifierType)
  type!: ContactIdentifierType;

  @IsString()
  @MinLength(3)
  value!: string;
}
