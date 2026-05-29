import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "./prisma.service.js";
import { UserId } from "./user-id.decorator.js";

const createChatSchema = z.object({ title: z.string().default("New chat") });

/** Shape returned for a chat across create/list/get — kept consistent. */
const CHAT_SELECT = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Controller("api/chats")
export class ChatsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Create a chat. */
  @Post()
  @HttpCode(200)
  async create(@UserId() userId: string, @Body() body: unknown) {
    const parsed = createChatSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.prisma.chat.create({
      data: { userId, title: parsed.data.title },
      select: CHAT_SELECT,
    });
  }

  /** List the user's chats, newest first. */
  @Get()
  list(@UserId() userId: string) {
    return this.prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: CHAT_SELECT,
    });
  }

  /** Return a single chat if owned. */
  @Get(":id")
  async getOne(@UserId() userId: string, @Param("id") id: string) {
    const chat = await this.prisma.chat.findFirst({
      where: { id, userId },
      select: CHAT_SELECT,
    });
    if (!chat) throw new NotFoundException();
    return chat;
  }

  /** Delete a chat if owned. */
  @Delete(":id")
  async remove(@UserId() userId: string, @Param("id") id: string) {
    const { count } = await this.prisma.chat.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException();
    return { ok: true };
  }

  /** Return messages for an owned chat. */
  @Get(":id/messages")
  async messages(@UserId() userId: string, @Param("id") id: string) {
    const chat = await this.prisma.chat.findFirst({ where: { id, userId } });
    if (!chat) throw new NotFoundException();
    return this.prisma.message.findMany({
      where: { chatId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        chatId: true,
        role: true,
        content: true,
        createdAt: true,
        attachments: { select: { id: true, filename: true, mimeType: true } },
      },
    });
  }
}
