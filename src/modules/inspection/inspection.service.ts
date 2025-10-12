import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection } from './entities/inspection.entity';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { InspectionStatus } from './enums/inspection-status.enum';

@Injectable()
export class InspectionService {
  constructor(
    @InjectRepository(Inspection)
    private inspectionRepository: Repository<Inspection>,
  ) {}

  async create(createInspectionDto: CreateInspectionDto): Promise<Inspection> {
    const inspection = this.inspectionRepository.create(createInspectionDto);
    return this.inspectionRepository.save(inspection);
  }

  async findAll(): Promise<Inspection[]> {
    return this.inspectionRepository.find({
      relations: ['vehicle', 'inspector'],
    });
  }

  async findOne(id: string): Promise<Inspection> {
    const inspection = await this.inspectionRepository.findOne({
      where: { id },
      relations: ['vehicle', 'inspector'],
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    return inspection;
  }

  async findByVehicle(vehicleId: string): Promise<Inspection[]> {
    return this.inspectionRepository.find({
      where: { vehicleId },
      relations: ['vehicle', 'inspector'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByInspector(inspectorId: string): Promise<Inspection[]> {
    return this.inspectionRepository.find({
      where: { inspectorId },
      relations: ['vehicle', 'inspector'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateInspectionDto: UpdateInspectionDto): Promise<Inspection> {
    const inspection = await this.findOne(id);
    Object.assign(inspection, updateInspectionDto);
    return this.inspectionRepository.save(inspection);
  }

  async startInspection(id: string, inspectorId: string): Promise<Inspection> {
    const inspection = await this.findOne(id);
    
    inspection.status = InspectionStatus.IN_PROGRESS;
    inspection.actualDate = new Date();
    inspection.inspectorId = inspectorId;
    
    return this.inspectionRepository.save(inspection);
  }

  async completeInspection(
    id: string, 
    results: {
      exteriorPassed: boolean;
      interiorPassed: boolean;
      mechanicalPassed: boolean;
      documentsPassed: boolean;
      safetyPassed: boolean;
      overallScore: number;
      notes?: string;
      photos?: string[];
    }
  ): Promise<Inspection> {
    const inspection = await this.findOne(id);
    
    Object.assign(inspection, results);
    
    // Determine overall status based on individual results
    const allPassed = results.exteriorPassed && 
                     results.interiorPassed && 
                     results.mechanicalPassed && 
                     results.documentsPassed && 
                     results.safetyPassed;
    
    inspection.status = allPassed ? InspectionStatus.PASSED : InspectionStatus.FAILED;
    
    return this.inspectionRepository.save(inspection);
  }

  async rescheduleInspection(id: string, newDate: Date): Promise<Inspection> {
    const inspection = await this.findOne(id);
    
    inspection.status = InspectionStatus.RESCHEDULED;
    inspection.scheduledDate = newDate;
    
    return this.inspectionRepository.save(inspection);
  }

  async cancelInspection(id: string, reason: string): Promise<Inspection> {
    const inspection = await this.findOne(id);
    
    inspection.status = InspectionStatus.CANCELLED;
    inspection.notes = inspection.notes ? `${inspection.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
    
    return this.inspectionRepository.save(inspection);
  }

  async getInspectionHistory(vehicleId: string): Promise<Inspection[]> {
    return this.inspectionRepository.find({
      where: { vehicleId },
      relations: ['inspector'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingInspections(): Promise<Inspection[]> {
    return this.inspectionRepository.find({
      where: { status: InspectionStatus.PENDING },
      relations: ['vehicle', 'inspector'],
      order: { scheduledDate: 'ASC' },
    });
  }
}
