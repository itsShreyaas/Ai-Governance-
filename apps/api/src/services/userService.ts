import argon2 from "argon2";
import mongoose from "mongoose";
import { AuditEventType, AuditSeverity, UserRole } from "@aegisai/shared";
import type { CreateUserInput, UpdateUserInput, UserListQuery } from "@aegisai/shared";
import { HttpError } from "../middleware/httpError.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User, type IUser } from "../models/User.js";
import { appendAuditEvent } from "./auditService.js";
import { paginate } from "./pagination.js";

export interface UserActor {
  id: string;
  department: string;
}

function publicUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function listUsers(query: UserListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.role != null) filter.role = query.role;
  if (query.department != null) filter.department = query.department;
  if (query.isActive != null) filter.isActive = query.isActive;
  const result = await paginate(
    User.find(filter)
      .select("name email department role isActive createdAt")
      .sort({ [query.sort]: query.direction === "asc" ? 1 : -1, _id: 1 })
      .lean(),
    User.countDocuments(filter),
    query.page,
    query.limit
  );
  return {
    ...result,
    data: result.data.map((record) => ({
      id: record._id.toString(),
      name: record.name,
      email: record.email,
      department: record.department,
      role: record.role,
      isActive: record.isActive,
      createdAt: record.createdAt,
    })),
  };
}

export async function createUser(input: CreateUserInput, actor: UserActor) {
  const session = await mongoose.startSession();
  let created: IUser | null = null;
  try {
    await session.withTransaction(async () => {
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      const [user] = await User.create(
        [{
          name: input.name,
          email: input.email,
          department: input.department,
          role: input.role,
          passwordHash,
          isActive: true,
        }],
        { session }
      );
      if (user == null) throw new Error("User creation failed");
      await appendAuditEvent(
        {
          eventType: AuditEventType.UserCreated,
          severity: AuditSeverity.Info,
          actorId: actor.id,
          department: actor.department,
          details: "User created",
        },
        session
      );
      created = user;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new HttpError(409, "DUPLICATE_EMAIL", "A user with this email already exists");
    throw error;
  } finally {
    await session.endSession();
  }
  if (created == null) throw new Error("User creation transaction did not complete");
  return publicUser(created);
}

export async function updateUser(id: string, input: UpdateUserInput, actor: UserActor) {
  const session = await mongoose.startSession();
  let updated: IUser | null = null;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(id).session(session);
      if (user == null) throw new HttpError(404, "USER_NOT_FOUND", "User was not found");
      if (user.role === UserRole.System) {
        throw new HttpError(403, "SYSTEM_USER_IMMUTABLE", "System users cannot be edited");
      }
      const selfChangeDenied = user._id.toString() === actor.id &&
        ((input.role != null && input.role !== UserRole.Admin) || input.isActive === false);
      if (selfChangeDenied) {
        throw new HttpError(409, "SELF_ADMIN_CHANGE_DENIED", "An admin cannot demote or deactivate their own account");
      }

      const removingAdmin = user.role === UserRole.Admin && user.isActive &&
        ((input.role != null && input.role !== UserRole.Admin) || input.isActive === false);
      if (removingAdmin) {
        const activeAdminCount = await User.countDocuments({ role: UserRole.Admin, isActive: true }).session(session);
        if (activeAdminCount <= 1) {
          throw new HttpError(409, "LAST_ADMIN_REQUIRED", "The last active admin cannot be demoted or deactivated");
        }
      }

      const roleChanged = input.role != null && input.role !== user.role;
      Object.assign(user, input);
      if (input.isActive === false) {
        await RefreshToken.updateMany(
          { userId: user._id, revokedAt: null },
          { $set: { revokedAt: new Date() } },
          { session }
        );
      }
      await user.save({ session });
      updated = user;
      await appendAuditEvent(
        {
          eventType: roleChanged ? AuditEventType.RoleChanged : AuditEventType.UserUpdated,
          severity: AuditSeverity.Info,
          actorId: actor.id,
          department: actor.department,
          details: input.isActive === false ? "User deactivated" : roleChanged ? "User role changed" : "User updated",
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
  if (updated == null) throw new Error("User update transaction did not complete");
  return publicUser(updated);
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}