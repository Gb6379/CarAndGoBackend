import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PDFParse } from 'pdf-parse';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserType } from './enums/user-type.enum';
import { UserStatus } from './enums/user-status.enum';

type CrlvExtractedData = {
  licensePlate?: string;
  renavam?: string;
  chassis?: string;
  make?: string;
  model?: string;
  year?: string;
  color?: string;
  fuelType?: string;
  vehicleType?: string;
  source?: 'pdf' | 'image' | 'unknown';
  extractionStatus?: 'parsed' | 'partial' | 'unsupported';
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /** Marcas comuns no Brasil (para identificar o valor real no texto do CRLV). */
  private static readonly KNOWN_MAKES = [
    'VOLKSWAGEN', 'VW', 'CHEVROLET', 'GM', 'FIAT', 'FORD', 'TOYOTA', 'HONDA',
    'HYUNDAI', 'RENAULT', 'NISSAN', 'JEEP', 'PEUGEOT', 'CITROEN', 'MITSUBISHI',
    'KIA', 'BMW', 'MERCEDES-BENZ', 'MERCEDES', 'AUDI', 'VOLVO', 'LAND ROVER',
    'SUZUKI', 'SUBARU', 'CHERY', 'CAOA CHERY', 'CAOA', 'BYD', 'GWM', 'HAVAL',
    'RAM', 'DODGE', 'CHRYSLER', 'MINI', 'PORSCHE', 'JAGUAR', 'LEXUS', 'TROLLER',
    'IVECO', 'AGRALE', 'SSANGYONG', 'SMART', 'LIFAN', 'JAC', 'EFFA', 'GEELY',
  ];

  /** Cores predominantes possíveis no CRLV. */
  private static readonly KNOWN_COLORS = [
    'AMARELA', 'AZUL', 'BEGE', 'BRANCA', 'CINZA', 'CHUMBO', 'CREME', 'DOURADA',
    'GRENA', 'LARANJA', 'MARROM', 'PEROLA', 'PRATA', 'PRETA', 'ROSA', 'ROXA',
    'VERDE', 'VERMELHA', 'VINHO', 'FANTASIA',
  ];

  /** Palavras que indicam fim do nome do modelo no texto do documento. */
  private static readonly MODEL_STOP_WORDS = new Set([
    'ESPECIE', 'TIPO', 'PASSAGEIRO', 'AUTOMOVEL', 'CAMINHONETE', 'CAMINHAO',
    'MOTOCICLETA', 'PLACA', 'CHASSI', 'CHASSIS', 'COR', 'CATEGORIA', 'POTENCIA',
    'CILINDRADA', 'MOTOR', 'COMBUSTIVEL', 'ANO', 'LOCAL', 'CAT', 'CLA', 'PESO',
    'EIXOS', 'LOTACAO', 'CARROCERIA', 'NOME', 'CPF', 'CNPJ', 'RENAVAM',
    'EXERCICIO', 'CODIGO', 'SECRETARIA', 'MINISTERIO', 'REPUBLICA', 'DETRAN',
    'OBSERVACOES', 'ALIENACAO', 'FIDUCIARIA', 'NAO', 'APLICAVEL', 'DPVAT',
    'SEGURO', 'ANTERIOR', 'UF', 'CAPACIDADE', 'CMT', 'CRV', 'CRLV', 'DATA',
  ]);

  toProfileResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      cpfCnpj: user.cpfCnpj,
      userType: user.userType,
      status: user.status,
      phone: user.phone,
      birthDate: user.birthDate,
      street: user.street,
      number: user.number,
      complement: user.complement,
      neighborhood: user.neighborhood,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      documentsVerified: user.documentsVerified,
      govBrId: user.govBrId,
      creditScore: user.creditScore,
      criminalBackgroundCheck: user.criminalBackgroundCheck,
      profilePhoto: user.profilePhoto,
      bankName: user.bankName,
      bankAgency: user.bankAgency,
      bankAccount: user.bankAccount,
      bankAccountType: user.bankAccountType,
      bankHolderName: user.bankHolderName,
      bankHolderDocument: user.bankHolderDocument,
      pixKey: user.pixKey,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

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
    return this.findForAdmin();
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
    return this.findForAdmin({ userType });
  }

  async findForAdmin(filters: { userType?: UserType; status?: string } = {}): Promise<User[]> {
    const where: FindOptionsWhere<User> = {};
    const normalizedStatus = (filters.status || '').trim().toLowerCase();

    if (filters.userType) {
      where.userType = filters.userType;
    }

    if (Object.values(UserStatus).includes(normalizedStatus as UserStatus)) {
      where.status = normalizedStatus as UserStatus;
    }

    return this.userRepository.find({
      where: Object.keys(where).length ? where : undefined,
      select: ['id', 'email', 'firstName', 'lastName', 'userType', 'status', 'documentsVerified', 'createdAt'],
      order: { createdAt: 'DESC' },
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

  async approveDocuments(id: string): Promise<User> {
    const [user, cnhDocument, cacDocument] = await Promise.all([
      this.findOne(id),
      this.getCnhDocument(id),
      this.getCacDocument(id),
    ]);

    if (!cnhDocument || !cacDocument) {
      throw new BadRequestException('O usuário precisa enviar CNH e CAC antes de ser aprovado.');
    }

    user.documentsVerified = true;
    user.criminalBackgroundCheck = true;
    user.status = UserStatus.ACTIVE;

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

  private normalizeDocText(raw: string): string {
    return (raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\r/g, '\n')
      .toUpperCase();
  }

  private extractField(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return undefined;
  }

  private sanitizeExtractedValue(raw?: string): string | undefined {
    if (!raw) return undefined;
    const value = raw
      .replace(/\s+/g, ' ')
      .replace(/^[:\-]+/, '')
      .trim();
    if (!value) return undefined;
    if (/^[*.\-/\s]+$/.test(value)) return undefined;
    return value;
  }

  private looksLikeDocLabel(value?: string): boolean {
    const v = this.sanitizeExtractedValue(value);
    if (!v) return true;
    const normalized = this.normalizeDocText(v);
    const labelTokens = [
      'CODIGO',
      'PLACA',
      'RENAVAM',
      'CHASSI',
      'ANO',
      'FABRICACAO',
      'MODELO',
      'MARCA',
      'VERSAO',
      'COR',
      'PREDOMINANTE',
      'COMBUSTIVEL',
      'ESPECIE',
      'TIPO',
      'PLACA ANTERIOR',
      'ANTERIOR',
      'UF',
      'EXERCICIO',
      'CAPACIDADE',
      'PESO',
      'MOTOR',
      'EIXOS',
      'LOTACAO',
      'CAT',
      'CLA',
      'CATEGORIA',
      'NOME',
      'CPF',
      'CNPJ',
      'LOCAL',
      'DATA',
      'POTENCIA',
      'CARROCERIA',
      'ASSINADO',
      'DPVAT',
      'SEGURO',
    ];
    return labelTokens.some((token) => normalized.includes(token));
  }

  private extractFieldValidated(text: string, patterns: RegExp[]): string | undefined {
    const raw = this.extractField(text, patterns);
    const sanitized = this.sanitizeExtractedValue(raw);
    if (!sanitized || this.looksLikeDocLabel(sanitized)) return undefined;
    return sanitized;
  }

  private splitMakeModel(raw?: string): { make?: string; model?: string } {
    if (!raw) return {};
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    const separators = ['/', '-', '|'];
    for (const separator of separators) {
      if (cleaned.includes(separator)) {
        const [make, ...rest] = cleaned.split(separator).map((part) => part.trim()).filter(Boolean);
        if (!make) return {};
        const model = rest.join(' ').trim();
        return { make, model: model || undefined };
      }
    }
    const words = cleaned.split(' ');
    if (words.length <= 1) return { make: cleaned };
    return { make: words[0], model: words.slice(1).join(' ') };
  }

  private mapVehicleType(raw?: string): string | undefined {
    if (!raw) return undefined;
    const normalized = this.normalizeDocText(raw);
    if (normalized.includes('PICK') || normalized.includes('CAMINHONETE')) return 'pickup';
    if (normalized.includes('SUV') || normalized.includes('UTILITARIO')) return 'suv';
    if (normalized.includes('HATCH')) return 'hatchback';
    if (normalized.includes('SEDAN')) return 'sedan';
    if (normalized.includes('CONVERS')) return 'convertible';
    if (normalized.includes('COUPE')) return 'coupe';
    return undefined;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extrai marca/modelo procurando o padrão "MARCA/MODELO" cujo lado esquerdo
   * é uma marca conhecida. Isso evita capturar rótulos como "PLACA ANTERIOR/UF".
   */
  private extractMakeModelByKnownMake(joined: string): { make?: string; model?: string } {
    // Ordena por tamanho desc para casar "MERCEDES-BENZ" antes de "MERCEDES".
    const makes = [...UserService.KNOWN_MAKES].sort((a, b) => b.length - a.length);
    for (const mk of makes) {
      const re = new RegExp(`\\b${this.escapeRegex(mk)}\\s*/\\s*([A-Z0-9][A-Z0-9 .\\-]{0,40})`);
      const match = joined.match(re);
      if (!match) continue;

      const make = mk === 'VW' ? 'VOLKSWAGEN' : mk === 'GM' ? 'CHEVROLET' : mk;
      const model = this.cleanModel(match[1]);
      return { make, model: model || undefined };
    }
    return {};
  }

  private cleanModel(raw: string): string {
    const words = raw.replace(/\s+/g, ' ').trim().split(' ');
    const out: string[] = [];
    for (const word of words) {
      const token = word.replace(/[^A-Z0-9.\-]/g, '');
      if (!token) continue;
      if (/^\d{3,}$/.test(token)) break; // números longos = outro campo
      if (UserService.MODEL_STOP_WORDS.has(token)) break;
      out.push(token);
      if (out.length >= 4) break; // nomes de modelo costumam ser curtos
    }
    return out.join(' ').trim();
  }

  private extractColorFromList(joined: string): string | undefined {
    for (const color of UserService.KNOWN_COLORS) {
      if (new RegExp(`\\b${color}\\b`).test(joined)) return color;
    }
    return undefined;
  }

  private extractFuelFromList(joined: string): string | undefined {
    if (/\bELETRIC/.test(joined)) return 'eletrico';
    if (/\b(GASOLINA|ALCOOL|ETANOL|DIESEL|FLEX|HIBRIDO|GNV)\b/.test(joined)) {
      return 'combustao';
    }
    return undefined;
  }

  private extractYearSmart(joined: string): string | undefined {
    const labeled =
      joined.match(/ANO\s*MODELO\D{0,15}((?:19|20)\d{2})/)?.[1] ||
      joined.match(/((?:19|20)\d{2})\D{0,8}ANO\s*MODELO/)?.[1] ||
      joined.match(/ANO\s*FABRICACAO\D{0,15}((?:19|20)\d{2})/)?.[1] ||
      joined.match(/((?:19|20)\d{2})\D{0,8}ANO\s*FABRICACAO/)?.[1];
    if (labeled) return labeled;

    const years = joined.match(/\b(?:19[89]\d|20[0-3]\d)\b/g) || [];
    if (!years.length) return undefined;

    const freq = new Map<string, number>();
    for (const y of years) freq.set(y, (freq.get(y) || 0) + 1);

    let best = years[0];
    let bestCount = 0;
    for (const [y, count] of freq) {
      if (count > bestCount || (count === bestCount && Number(y) < Number(best))) {
        best = y;
        bestCount = count;
      }
    }
    return best;
  }

  private parseCrlvText(text: string): CrlvExtractedData {
    const normalized = this.normalizeDocText(text);
    const joined = normalized.replace(/\s+/g, ' ').trim();

    const plateMatch = normalized.match(/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/);
    const licensePlate = plateMatch?.[1];

    const renavam = this.extractFieldValidated(normalized, [
      /RENAVAM\s*[:\-]?\s*([0-9.\-]{9,20})/,
      /CODIGO\s+RENAVAM\s*[:\-]?\s*([0-9.\-]{9,20})/,
    ])?.replace(/\D/g, '');

    const chassis = this.extractFieldValidated(normalized, [
      /CHASSI\s*[:\-]?\s*([A-HJ-NPR-Z0-9]{11,20})/,
      /CHASSIS\s*[:\-]?\s*([A-HJ-NPR-Z0-9]{11,20})/,
    ]);

    // Marca/modelo: identifica pelo padrão "MARCA/MODELO" com marca conhecida.
    let { make, model } = this.extractMakeModelByKnownMake(joined);
    if (!make) {
      // Fallback: valor após rótulo, com validação contra rótulos.
      const makeModelRaw = this.extractFieldValidated(normalized, [
        /MARCA(?:\s*\/\s*MODELO)?(?:\s*\/\s*VERSAO)?\s*[:\-]?\s*([A-Z][A-Z0-9 .\-]*\/[A-Z0-9 .\-]+)/,
      ]);
      const split = this.splitMakeModel(makeModelRaw);
      make = split.make;
      model = split.model;
    }

    const year = this.extractYearSmart(joined);
    const color = this.extractColorFromList(joined);
    const fuelType = this.extractFuelFromList(joined);

    const vehicleTypeRaw = this.extractFieldValidated(normalized, [
      /ESPECIE\s*\/\s*TIPO\s*[:\-]?\s*([A-Z\/ ]{3,40})/,
    ]);

    const extracted: CrlvExtractedData = {
      licensePlate,
      renavam,
      chassis,
      make,
      model,
      year,
      color,
      fuelType,
      vehicleType: this.mapVehicleType(vehicleTypeRaw),
      source: 'pdf',
      extractionStatus: 'partial',
    };

    const score = [licensePlate, make, model, year, fuelType].filter(Boolean).length;
    extracted.extractionStatus = score >= 4 ? 'parsed' : score >= 2 ? 'partial' : 'unsupported';
    return extracted;
  }

  async extractCrlvData(data: Buffer, mimeType: string): Promise<CrlvExtractedData> {
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: new Uint8Array(data) });
      try {
        const parsed = await parser.getText();
        const rawText = parsed.text || '';
        const result = this.parseCrlvText(rawText);
        this.logger.log(
          `CRLV parse -> ${JSON.stringify({
            make: result.make,
            model: result.model,
            year: result.year,
            color: result.color,
            fuelType: result.fuelType,
            licensePlate: result.licensePlate,
            status: result.extractionStatus,
          })}`,
        );
        this.logger.log(`CRLV raw text (first 1500 chars): ${rawText.slice(0, 1500)}`);
        return result;
      } finally {
        await parser.destroy();
      }
    }

    return {
      source: 'image',
      extractionStatus: 'unsupported',
    };
  }

  async updateCrlvDocument(
    userId: string,
    data: Buffer,
    mimeType: string,
    extractedData: CrlvExtractedData,
  ): Promise<void> {
    const user = await this.findOne(userId);
    user.crlvDocumentData = data;
    user.crlvDocumentMimeType = mimeType;
    user.crlvExtractedData = extractedData;
    await this.userRepository.save(user);
  }

  async getCrlvExtractedData(userId: string): Promise<CrlvExtractedData | null> {
    const row = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.crlvExtractedData', 'extractedData')
      .where('user.id = :id', { id: userId })
      .getRawOne<{ extractedData: CrlvExtractedData }>();
    return row?.extractedData || null;
  }
}
