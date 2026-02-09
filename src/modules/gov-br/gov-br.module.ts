import { Module } from '@nestjs/common';
import { GovBrService } from './services/gov-br.service';
import { GovBrController } from './gov-br.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [GovBrController],
  providers: [GovBrService],
  exports: [GovBrService],
})
export class GovBrModule {}
