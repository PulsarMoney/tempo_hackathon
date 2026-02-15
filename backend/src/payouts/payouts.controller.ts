import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { ExecutePayoutDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user';

@Controller('payouts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'operator')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('execute')
  async execute(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: ExecutePayoutDto) {
    return this.payoutsService.executePayouts({
      poolId: body.poolId,
      currentUser,
    });
  }

  @Get(':executionId')
  async getExecution(@Param('executionId') executionId: string) {
    return this.payoutsService.getExecutionStatus(executionId);
  }
}
