import { IsString, MinLength } from 'class-validator';

export class VerifyPrivyTokenDto {
  @IsString()
  @MinLength(10)
  accessToken!: string;
}
