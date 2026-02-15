import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class PoolTradeEventDto {
  @IsString()
  betId!: string;

  @IsString()
  status!: 'won' | 'lost';

  @IsString()
  stake!: string;

  @IsString()
  payout!: string;

  @IsString()
  resolvedAtTick!: string;
}

export class SubmitPoolTradesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoolTradeEventDto)
  trades!: PoolTradeEventDto[];
}
