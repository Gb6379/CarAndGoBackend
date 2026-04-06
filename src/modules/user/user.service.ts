import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserType } from './enums/user-type.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const emailNorm = createUserDto.email.trim().toLowerCase();
    const existingByEmail = await this.findByEmail(emailNorm);
    const existingByCpf = await this.userRepository.findOne({
      where: { cpfCnpj: createUserDto.cpfCnpj },
    });
    if (existingByEmail || existingByCpf) {
      throw new ConflictException('User with this email or CPF/CNPJ already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      email: emailNorm,
      password: hashedPassword,
    });

    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'userType', 'status', 'createdAt'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['vehicles', 'bookings'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return null;
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalized })
      .getOne();
  }

  async findByCpfCnpj(cpfCnpj: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { cpfCnpj } });
  }

  /** Encontra usuário por e-mail ou por CPF/CNPJ (aceita com ou sem formatação). */
  async findByEmailOrCpf(identifier: string): Promise<User | null> {
    const trimmed = (identifier || '').trim();
    if (!trimmed) return null;
    if (trimmed.includes('@')) {
      return this.findByEmail(trimmed);
    }
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 11) return null;
    const byNormalized = await this.userRepository.findOne({ where: { cpfCnpj: digitsOnly } });
    if (byNormalized) return byNormalized;
    return this.userRepository.findOne({ where: { cpfCnpj: trimmed } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.cpfCnpj !== undefined) {
      const cpfCnpjNormalized = (updateUserDto.cpfCnpj || '').replace(/\D/g, '');
      if (cpfCnpjNormalized.length > 0) {
        const existing = await this.userRepository.findOne({
          where: { cpfCnpj: cpfCnpjNormalized },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException('Este CPF/CNPJ já está cadastrado para outra conta.');
        }
        (updateUserDto as any).cpfCnpj = cpfCnpjNormalized;
      }
    }

    Object.assign(user, updateUserDto);

    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async findByUserType(userType: UserType): Promise<User[]> {
    return this.userRepository.find({
      where: { userType },
      select: ['id', 'email', 'firstName', 'lastName', 'userType', 'status', 'createdAt'],
    });
  }

  async getStats(): Promise<{ totalUsers: number; lessors: number; lessees: number }> {
    const [total, lessors, lessees] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { userType: UserType.LESSOR } }),
      this.userRepository.count({ where: { userType: UserType.LESSEE } }),
    ]);
    const both = await this.userRepository.count({ where: { userType: UserType.BOTH } });
    return {
      totalUsers: total,
      lessors: lessors + both,
      lessees: lessees + both,
    };
  }

  async updateStatus(id: string, status: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = status as any;
    return this.userRepository.save(user);
  }

  async updateProfilePhoto(userId: string, data: Buffer, mimeType: string): Promise<User> {
    const user = await this.findOne(userId);
    user.profilePhoto = 'inline';
    user.profilePhotoData = data;
    user.profilePhotoMimeType = mimeType;
    return this.userRepository.save(user);
  }

  async getProfilePhoto(userId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['profilePhotoData', 'profilePhotoMimeType'],
    });
    if (!user?.profilePhotoData) return null;
    return { data: user.profilePhotoData, mimeType: user.profilePhotoMimeType || 'image/jpeg' };
  }

  async updateCnhDocument(userId: string, data: Buffer, mimeType: string): Promise<void> {
    const user = await this.findOne(userId);
    user.cnhDocumentData = data;
    user.cnhDocumentMimeType = mimeType;
    await this.userRepository.save(user);
  }

  async updateCacDocument(userId: string, data: Buffer, mimeType: string): Promise<void> {
    const user = await this.findOne(userId);
    user.cacDocumentData = data;
    user.cacDocumentMimeType = mimeType;
    await this.userRepository.save(user);
  }

  async getCnhDocument(userId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const row = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.cnhDocumentData', 'data')
      .addSelect('user.cnhDocumentMimeType', 'mimeType')
      .where('user.id = :id', { id: userId })
      .getRawOne<{ data: Buffer; mimeType: string }>();
    if (!row?.data) return null;
    return { data: row.data, mimeType: row.mimeType || 'application/octet-stream' };
  }

  async getCacDocument(userId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const row = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.cacDocumentData', 'data')
      .addSelect('user.cacDocumentMimeType', 'mimeType')
      .where('user.id = :id', { id: userId })
      .getRawOne<{ data: Buffer; mimeType: string }>();
    if (!row?.data) return null;
    return { data: row.data, mimeType: row.mimeType || 'application/octet-stream' };
  }
}
