import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserAccountEntity, UserEntity, UserRoleEntity } from '../db/entities';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserAccountEntity, UserRoleEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
