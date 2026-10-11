package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.SocialAccount;
import com.ajou.muscleup.entity.SocialProvider;
import com.ajou.muscleup.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, Long> {
    @EntityGraph(attributePaths = "user")
    Optional<SocialAccount> findByProviderAndProviderUserId(SocialProvider provider, String providerUserId);

    List<SocialAccount> findAllByUser(User user);

    boolean existsByUserAndProvider(User user, SocialProvider provider);
}
