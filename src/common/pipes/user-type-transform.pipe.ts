import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class UserTypeTransformPipe implements PipeTransform {
  private readonly userTypeMapping: { [key: string]: string } = {
    'quero alugar carros': 'lessee',      // Locatário
    'quero alugar meu carro': 'lessor',   // Locador
    'ambos': 'both',                       // Ambos
    'rent': 'lessee',                      // Alias for lessee
    'rent_out': 'lessor',                  // Alias for lessor
    'host': 'lessor',                      // Alias for lessor (host = car owner)
  };

  transform(value: any, metadata: ArgumentMetadata) {
    // Only apply this transformation to the body
    if (metadata.type === 'body' && value.userType) {
      const userTypeLower = value.userType.toLowerCase();
      const mappedUserType = this.userTypeMapping[userTypeLower];
      
      if (mappedUserType) {
        value.userType = mappedUserType;
      }
    }
    return value;
  }
}

