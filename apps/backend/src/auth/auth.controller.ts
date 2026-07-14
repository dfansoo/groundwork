import {
  Headers,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ExchangeAuthDto } from './dto/exchange-auth.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ProviderParamsDto } from './dto/provider-params.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SessionParamsDto } from './dto/session-params.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ExchangeSecretGuard } from './exchange-secret.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { THROTTLER_CREDENTIALS, THROTTLER_IP } from './throttle.config';

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ [THROTTLER_CREDENTIALS]: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  /**
   * Three limits stack here. The `credentials` throttler caps guesses at one
   * account from one host; the `ip` throttler stops an attacker sidestepping that
   * by rotating the email; and AuthService.login locks the account outright after
   * ten consecutive failures, which is the only one that survives an attacker
   * rotating IPs too.
   *
   * The limit stays above the lockout threshold on purpose: hitting ten failures
   * should lock the account (403), not merely rate-limit it (429).
   */
  @Post('login')
  @Throttle({ [THROTTLER_CREDENTIALS]: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Log in and get a JWT' })
  @ApiResponse({ status: 200, description: 'Returns an access token.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Account temporarily locked.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ [THROTTLER_IP]: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change your own password; revokes every other session',
  })
  @ApiResponse({ status: 200, description: 'Password updated.' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect.' })
  async changePassword(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ [THROTTLER_CREDENTIALS]: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({
    status: 200,
    description: 'Always returns 200 (non-enumerating).',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ [THROTTLER_IP]: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset a password using a valid token' })
  @ApiResponse({ status: 200, description: 'Password updated.' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(ExchangeSecretGuard)
  @Post('exchange')
  @ApiOperation({
    summary: 'Exchange a trusted external identity for a Nest access token',
  })
  @ApiResponse({ status: 201, description: 'Returns a Nest access token.' })
  @ApiResponse({ status: 401, description: 'Invalid exchange secret.' })
  async exchangeIdentity(
    @Headers('x-auth-exchange-secret') _exchangeSecret: string,
    @Body() exchangeAuthDto: ExchangeAuthDto,
  ) {
    return this.authService.exchangeIdentity(exchangeAuthDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new token pair' })
  @ApiResponse({
    status: 201,
    description: 'Returns a new access and refresh token pair.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token is invalid or expired.',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshSession(refreshTokenDto);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current refresh token session' })
  @ApiResponse({ status: 201, description: 'Refresh token session revoked.' })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.revokeSession(refreshTokenDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List active refresh sessions for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Returns active refresh sessions.' })
  async listSessions(@Request() req: { user: AuthenticatedUser }) {
    return this.authService.listSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke one refresh session for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Refresh session revoked.' })
  async revokeSessionById(
    @Request() req: { user: AuthenticatedUser },
    @Param() params: SessionParamsDto,
  ) {
    return this.authService.revokeSessionById(req.user.id, params.sessionId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('providers')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List linked external providers for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns linked provider accounts.',
  })
  async listProviders(@Request() req: { user: AuthenticatedUser }) {
    return this.authService.listLinkedProviders(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('providers/link')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Link an external provider to the authenticated user',
  })
  @ApiResponse({ status: 201, description: 'Provider linked successfully.' })
  async linkProvider(
    @Request() req: { user: AuthenticatedUser },
    @Body() exchangeAuthDto: ExchangeAuthDto,
  ) {
    return this.authService.linkProvider(req.user.id, exchangeAuthDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('providers/:provider/:providerAccountId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unlink an external provider from the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Provider unlinked successfully.' })
  async unlinkProvider(
    @Request() req: { user: AuthenticatedUser },
    @Param() params: ProviderParamsDto,
  ) {
    return this.authService.unlinkProvider(
      req.user.id,
      params.provider,
      params.providerAccountId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProfile(@Request() req: { user: AuthenticatedUser }) {
    return this.authService.getProfile(req.user.id);
  }
}
