import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { PoolsModule } from './pools/pools.module';
import { PayoutsModule } from './payouts/payouts.module';
import { ChainModule } from './chain/chain.module';
import { HealthModule } from './health/health.module';
import { dbEntities } from './db/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: dbEntities,
      synchronize: true,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    UsersModule,
    ContactsModule,
    PoolsModule,
    PayoutsModule,
    ChainModule,
    HealthModule,
  ],
})
export class AppModule {}
