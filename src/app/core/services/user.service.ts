import {Injectable} from '@angular/core';
import {GithubService} from './github.service';
import {User, UserRole} from '../models/user.model';
import {map} from 'rxjs/operators';
import {Team} from '../models/team.model';
import {Observable, of, throwError} from 'rxjs';
import {DataService} from './data.service';
import {flatMap} from 'rxjs/internal/operators';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  public currentUser: User;

  constructor(private githubService: GithubService, private dataService: DataService) {}

  createUserModel(userLoginId: string): Observable<User> {
    return this.dataService.getDataFile().pipe(
      map((jsonData: {}) => {
        this.currentUser = this.createUser(jsonData, userLoginId);
        return this.currentUser;
      }),
      flatMap((user) => {
        if (user) { // valid user
          return of(user);
        } else {
          return throwError('Unauthorized user.');
        }
      })
    );
  }

  reset() {
    this.currentUser = undefined;
  }

  private createUser(data: {}, userLoginId: string): User {
    const userRole = this.parseUserRole(data, userLoginId);
    switch (userRole) {

      case UserRole.Student:
        const teamId = data['students-allocation'][userLoginId]['teamId'];
        const studentTeam = this.createTeamModel(data['team-structure'], teamId);
        return <User>{loginId: userLoginId, role: userRole, team: studentTeam};

      case UserRole.Tutor:
        const tutorTeams = new Array<Team>();
        for (const allocatedTeamId of Object.keys(data['tutors-allocation'][userLoginId])) {
          tutorTeams.push(this.createTeamModel(data['team-structure'], allocatedTeamId));
        }
        return <User>{loginId: userLoginId, role: userRole, allocatedTeams: tutorTeams};

      case UserRole.Admin:
        const studentTeams = new Array<Team>();
        for (const allocatedTeamId of Object.keys(data['admins-allocation'][userLoginId])) {
          studentTeams.push(this.createTeamModel(data['team-structure'], allocatedTeamId));
        }
        return <User>{loginId: userLoginId, role: userRole, allocatedTeams: studentTeams};
      default:
        return null;
    }
  }

  private createTeamModel(teamData: {}, teamId: string): Team {
    const teammates = new Array<User>();
    for (const teammate of Object.keys(teamData[teamId])) {
      teammates.push(<User>{loginId: teammate, role: UserRole.Student});
    }
    return <Team>{id: teamId, teamMembers: teammates};
  }

  /**
   * To be used to parse the JSON data containing data pertaining to the user role.
   *
   * @return NULL if user is unauthorized, meaning that no role is specified for the user.
   *         else the the role with the highest access rights will be returned.
   */
  private parseUserRole(data: {}, userLoginId: string): UserRole {
    let userRole: UserRole;
    if (data['roles']['students'] && data['roles']['students'][[userLoginId]]) {
      userRole = UserRole.Student;
    }
    if (data['roles']['tutors'] && data['roles']['tutors'][[userLoginId]]) {
      userRole = UserRole.Tutor;
    }
    if (data['roles']['admins'] && data['roles']['admins'][[userLoginId]]) {
      userRole = UserRole.Admin;
    }
    return userRole;
  }
}
