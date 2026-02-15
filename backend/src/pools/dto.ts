import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ResolveMode {
  MANUAL_ADMIN = 'manual_admin',
}

export class InvitedParticipantDto {
  @IsString()
  @IsEnum(['email', 'phone', 'privy'])
  type!: 'email' | 'phone' | 'privy';

  @IsString()
  @MinLength(2)
  value!: string;
}

export class CreatePoolDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  entryAmount!: string;

  @IsString()
  tokenAddress!: string;

  @IsDateString()
  closeAt!: string;

  @IsEnum(ResolveMode)
  resolveMode!: ResolveMode;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitedParticipantDto)
  invitedParticipants!: InvitedParticipantDto[];
}

export class JoinPoolDto {
  @IsString()
  userAddress!: string;

  @IsString()
  joinTxHash!: string;

  @IsString()
  memoHex!: string;
}

export class ResolvePoolDto {
  @IsObject()
  outcome!: Record<string, unknown>;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  winnerPrivyDids?: string[];
}
