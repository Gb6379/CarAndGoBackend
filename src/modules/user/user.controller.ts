import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** Tipo do arquivo enviado pelo Multer (memory storage). */
interface UploadedPhotoFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const ALLOWED_VERIFICATION_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/me')
  async getProfile(@Request() req) {
    const user = await this.userService.findOne(req.user.id);
    return this.userService.toProfileResponse(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile/me')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.userService.update(req.user.id, updateUserDto);
    return this.userService.toProfileResponse(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/me/photo')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadProfilePhoto(@Request() req, @UploadedFile() file: UploadedPhotoFile) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhuma imagem enviada.');
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use JPEG, PNG, GIF ou WebP.');
    }
    return this.userService.updateProfilePhoto(req.user.id, file.buffer, file.mimetype);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/me/photo')
  async getProfilePhoto(@Request() req, @Res() res: Response) {
    const photo = await this.userService.getProfilePhoto(req.user.id);
    if (!photo) {
      throw new NotFoundException('Foto de perfil não encontrada.');
    }
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(photo.data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/me/verification/cnh')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCnhDocument(@Request() req, @UploadedFile() file: UploadedPhotoFile) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    if (!ALLOWED_VERIFICATION_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use foto (JPEG, PNG, WebP) ou PDF.');
    }
    await this.userService.updateCnhDocument(req.user.id, file.buffer, file.mimetype);
    return { message: 'CNH enviada com sucesso.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/me/verification/cac')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCacDocument(@Request() req, @UploadedFile() file: UploadedPhotoFile) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    if (!ALLOWED_VERIFICATION_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use foto (JPEG, PNG, WebP) ou PDF.');
    }
    await this.userService.updateCacDocument(req.user.id, file.buffer, file.mimetype);
    return { message: 'CAC enviada com sucesso.' };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
