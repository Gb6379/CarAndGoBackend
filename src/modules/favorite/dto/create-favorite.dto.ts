import { IsUUID } from 'class-validator';

export class CreateFavoriteDto {
  @IsUUID()
  vehicleId: string;
}
