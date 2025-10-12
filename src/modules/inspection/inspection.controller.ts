import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InspectionService } from './inspection.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('inspections')
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createInspectionDto: CreateInspectionDto) {
    return this.inspectionService.create(createInspectionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.inspectionService.findAll();
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  getPendingInspections() {
    return this.inspectionService.getPendingInspections();
  }

  @Get('vehicle/:vehicleId')
  @UseGuards(JwtAuthGuard)
  findByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.inspectionService.findByVehicle(vehicleId);
  }

  @Get('inspector/:inspectorId')
  @UseGuards(JwtAuthGuard)
  findByInspector(@Param('inspectorId') inspectorId: string) {
    return this.inspectionService.findByInspector(inspectorId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.inspectionService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateInspectionDto: UpdateInspectionDto) {
    return this.inspectionService.update(id, updateInspectionDto);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  startInspection(@Param('id') id: string, @Body() body: { inspectorId: string }) {
    return this.inspectionService.startInspection(id, body.inspectorId);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  completeInspection(@Param('id') id: string, @Body() results: any) {
    return this.inspectionService.completeInspection(id, results);
  }

  @Post(':id/reschedule')
  @UseGuards(JwtAuthGuard)
  rescheduleInspection(@Param('id') id: string, @Body() body: { newDate: string }) {
    return this.inspectionService.rescheduleInspection(id, new Date(body.newDate));
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelInspection(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.inspectionService.cancelInspection(id, body.reason);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.inspectionService.findOne(id);
  }
}
