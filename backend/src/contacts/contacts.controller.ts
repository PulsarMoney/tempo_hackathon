import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { FindContactDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('contacts')
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post('find')
  async find(@Body() body: FindContactDto) {
    return this.contactsService.findByIdentifier(body);
  }
}
