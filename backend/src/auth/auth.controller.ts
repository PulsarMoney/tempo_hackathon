import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyPrivyTokenDto } from './dto';

@Controller('auth/privy')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verify')
  async verify(@Body() body: VerifyPrivyTokenDto) {
    const user = await this.authService.verifyAccessToken(body.accessToken);
    return {
      ok: true,
      user: {
        privyDid: user.privyDid,
        walletAddress: user.walletAddress,
        linkedAccounts: user.linkedAccounts,
      },
    };
  }
}
