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
  getProfile(@Request() req) {
    return this.userService.findOne(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile/me')
  updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(req.user.id, updateUserDto);
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
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(photo.data);
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
