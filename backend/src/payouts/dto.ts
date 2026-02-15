import { IsString } from 'class-validator';

export class ExecutePayoutDto {
  @IsString()
  poolId!: string;
}
