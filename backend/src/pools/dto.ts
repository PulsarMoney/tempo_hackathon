import {
  IsArray,
  IsInt,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum ResolveMode {
  MANUAL_ADMIN = 'manual_admin',
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

export class SubmitPoolScoreDto {
  @IsNumberString()
  pnl!: string;

  @IsNumberString()
  totalStake!: string;

  @IsNumberString()
  totalPayout!: string;

  @IsInt()
  wins!: number;

  @IsInt()
  losses!: number;
}
